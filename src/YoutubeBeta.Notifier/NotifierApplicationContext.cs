using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.AppNotifications.Builder;
using YoutubeBeta.Services;

namespace YoutubeBeta.Notifier;

internal sealed class NotifierApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _trayIcon;
    private readonly FileSystemWatcher _watcher;
    private readonly System.Windows.Forms.Timer _debounceTimer;
    private readonly System.Windows.Forms.Timer _recentVideoTimer;
    private readonly SynchronizationContext _uiContext;
    private readonly RecentVideoNotificationService _recentVideoNotifications;
    private UpdateState? _latestUpdate;
    private string _lastShownEventId;
    private bool _notificationsRegistered;

    public NotifierApplicationContext()
    {
        Directory.CreateDirectory(AppPaths.AppDataDirectory);
        _uiContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        _lastShownEventId = LoadNotifierState().LastShownEventId;
        WriteLog("Notifier starting.");

        _trayIcon = CreateTrayIcon();
        _trayIcon.Visible = true;

        RegisterNotifications();
        _recentVideoNotifications = new RecentVideoNotificationService(
            WriteLog,
            (title, message) =>
            {
                ShowBalloon(title, message);
                return true;
            },
            _notificationsRegistered);

        _debounceTimer = new System.Windows.Forms.Timer
        {
            Interval = 750
        };
        _debounceTimer.Tick += (_, _) =>
        {
            _debounceTimer.Stop();
            CheckForUpdates(showCurrentStatus: false);
        };

        _watcher = new FileSystemWatcher(AppPaths.AppDataDirectory)
        {
            Filter = Path.GetFileName(AppPaths.UpdateStatePath),
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size
        };
        _watcher.Changed += OnUpdateStateChanged;
        _watcher.Created += OnUpdateStateChanged;
        _watcher.Renamed += OnUpdateStateChanged;
        _watcher.EnableRaisingEvents = true;
        WriteLog($"Watching {AppPaths.UpdateStatePath}.");

        CheckForUpdates(showCurrentStatus: false);

        _recentVideoTimer = new System.Windows.Forms.Timer
        {
            Interval = (int)TimeSpan.FromHours(2).TotalMilliseconds
        };
        _recentVideoTimer.Tick += async (_, _) => await CheckRecentVideosAsync(showStatusWhenNoVideos: false).ConfigureAwait(true);
        _recentVideoTimer.Start();
        _ = CheckRecentVideosAsync(showStatusWhenNoVideos: false);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (_notificationsRegistered)
            {
                AppNotificationManager.Default.Unregister();
            }

            _watcher.Dispose();
            _debounceTimer.Dispose();
            _recentVideoTimer.Dispose();
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            WriteLog("Notifier stopped.");
        }

        base.Dispose(disposing);
    }

    private NotifyIcon CreateTrayIcon()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Youtube Beta", null, (_, _) => LaunchApp(_latestUpdate));
        menu.Items.Add("Check new videos now", null, async (_, _) => await CheckRecentVideosAsync(showStatusWhenNoVideos: true).ConfigureAwait(true));
        menu.Items.Add("Check update status", null, (_, _) => CheckForUpdates(showCurrentStatus: true));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit notifier", null, (_, _) => ExitThread());

        var icon = File.Exists(AppPaths.IconPath)
            ? new Icon(AppPaths.IconPath)
            : SystemIcons.Application;

        var notifyIcon = new NotifyIcon
        {
            ContextMenuStrip = menu,
            Icon = icon,
            Text = "Youtube Beta updates"
        };
        notifyIcon.DoubleClick += (_, _) => LaunchApp(_latestUpdate);
        notifyIcon.BalloonTipClicked += (_, _) => LaunchApp(_latestUpdate);
        return notifyIcon;
    }

    private void RegisterNotifications()
    {
        try
        {
            AppNotificationManager.Default.NotificationInvoked += (_, _) => LaunchApp(_latestUpdate);
            AppNotificationManager.Default.Register();
            _notificationsRegistered = true;
        }
        catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or COMException)
        {
            WriteLog($"Windows notifications unavailable: {ex.Message}");
            ShowBalloon("Youtube Beta notifier", "Windows notifications are unavailable. Tray notifications will be used instead.");
        }
    }

    private void OnUpdateStateChanged(object sender, FileSystemEventArgs e)
    {
        WriteLog($"Detected update-state change: {e.ChangeType}.");
        _uiContext.Post(_ =>
        {
            _debounceTimer.Stop();
            _debounceTimer.Start();
        }, null);
    }

    private void CheckForUpdates(bool showCurrentStatus)
    {
        WriteLog("Checking update state.");
        var update = TryReadUpdateState();
        if (update is null)
        {
            WriteLog("No readable update state found.");
            if (showCurrentStatus)
            {
                ShowBalloon("Youtube Beta", "No published update has been reported yet.");
            }

            return;
        }

        _latestUpdate = update;
        UpdateTrayTooltip(update);

        if (!IsPublishedUpdate(update))
        {
            WriteLog($"Ignoring update state with status '{update.Status}' and event '{update.EventId}'.");
            if (showCurrentStatus)
            {
                ShowBalloon("Youtube Beta", "No published update is ready right now.");
            }

            return;
        }

        if (string.Equals(update.EventId, _lastShownEventId, StringComparison.Ordinal))
        {
            WriteLog($"Update event already shown: {update.EventId}.");
            if (showCurrentStatus)
            {
                ShowBalloon("Youtube Beta", update.Message);
            }

            return;
        }

        ShowUpdateNotification(update);
        MarkShown(update.EventId);
        WriteLog($"Marked update event as shown: {update.EventId}.");
    }

    private static bool IsPublishedUpdate(UpdateState update)
    {
        return update.SchemaVersion == 1
            && string.Equals(update.Status, "Published", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(update.EventId);
    }

    private UpdateState? TryReadUpdateState()
    {
        if (!File.Exists(AppPaths.UpdateStatePath))
        {
            return null;
        }

        for (var attempt = 0; attempt < 4; attempt++)
        {
            try
            {
                using var stream = File.Open(AppPaths.UpdateStatePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                return JsonSerializer.Deserialize<UpdateState>(stream, JsonDefaults.Options);
            }
            catch (Exception ex) when (ex is IOException or JsonException)
            {
                if (attempt == 3)
                {
                    WriteLog($"Could not read update state: {ex.Message}");
                    return null;
                }

                Thread.Sleep(150);
            }
        }

        return null;
    }

    private static NotifierState LoadNotifierState()
    {
        try
        {
            if (!File.Exists(AppPaths.NotifierStatePath))
            {
                return new NotifierState();
            }

            using var stream = File.OpenRead(AppPaths.NotifierStatePath);
            return JsonSerializer.Deserialize<NotifierState>(stream, JsonDefaults.Options) ?? new NotifierState();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return new NotifierState();
        }
    }

    private void MarkShown(string eventId)
    {
        _lastShownEventId = eventId;
        var state = new NotifierState
        {
            LastShownEventId = eventId
        };
        File.WriteAllText(AppPaths.NotifierStatePath, JsonSerializer.Serialize(state, JsonDefaults.Options));
    }

    private void ShowUpdateNotification(UpdateState update)
    {
        var message = string.IsNullOrWhiteSpace(update.Message)
            ? $"Youtube Beta {update.Version} is ready."
            : update.Message;

        if (_notificationsRegistered)
        {
            try
            {
                var notification = new AppNotificationBuilder()
                    .AddArgument("action", "open")
                    .AddText("Youtube Beta updated")
                    .AddText(message)
                    .BuildNotification();

                AppNotificationManager.Default.Show(notification);
                WriteLog($"Showed Windows toast for event {update.EventId}.");
                return;
            }
            catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or COMException)
            {
                WriteLog($"Windows toast failed: {ex.Message}");
            }
        }

        ShowBalloon("Youtube Beta updated", message);
        WriteLog($"Showed tray balloon for event {update.EventId}.");
    }

    private void ShowBalloon(string title, string message)
    {
        _trayIcon.ShowBalloonTip(10000, title, message, ToolTipIcon.Info);
    }

    private async Task CheckRecentVideosAsync(bool showStatusWhenNoVideos)
    {
        try
        {
            await _recentVideoNotifications.CheckAsync(showStatusWhenNoVideos, CancellationToken.None)
                .ConfigureAwait(true);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or InvalidOperationException or JsonException or YouTubeApiException)
        {
            WriteLog($"Recent video check failed: {ex.Message}");
            if (showStatusWhenNoVideos)
            {
                ShowBalloon("Youtube Beta", $"Could not check for new videos. {ex.Message}");
            }
        }
    }

    private void UpdateTrayTooltip(UpdateState update)
    {
        var version = string.IsNullOrWhiteSpace(update.Version) ? "unknown version" : update.Version;
        _trayIcon.Text = TrimTooltip($"Youtube Beta ready: {version}");
    }

    private static string TrimTooltip(string value)
    {
        return value.Length <= 63 ? value : value[..63];
    }

    private void LaunchApp(UpdateState? update)
    {
        var appPath = update?.AppExePath;
        if (string.IsNullOrWhiteSpace(appPath))
        {
            appPath = AppPaths.PublishedAppExePath;
        }

        if (!File.Exists(appPath))
        {
            ShowBalloon("Youtube Beta", $"Could not find the app at {appPath}.");
            WriteLog($"Launch failed. App not found: {appPath}");
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = appPath,
            WorkingDirectory = Path.GetDirectoryName(appPath),
            UseShellExecute = true
        });
        WriteLog($"Launched app: {appPath}");
    }

    public static void WriteLog(string message)
    {
        try
        {
            var timestamp = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss zzz");
            File.AppendAllText(AppPaths.NotifierLogPath, $"[{timestamp}] {message}{Environment.NewLine}");
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
