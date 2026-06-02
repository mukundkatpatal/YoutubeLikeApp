using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.AppNotifications.Builder;
using YoutubeBeta.Models;
using YoutubeBeta.Services;

namespace YoutubeBeta.Notifier;

internal sealed class RecentVideoNotificationService
{
    private const int MaxVideosToNotify = 2;
    private readonly Action<string> _writeLog;
    private readonly Func<string, string, bool> _showFallbackNotification;
    private readonly bool _windowsNotificationsRegistered;
    private readonly bool _echoNotificationToFallback;

    public RecentVideoNotificationService(
        Action<string> writeLog,
        Func<string, string, bool> showFallbackNotification,
        bool windowsNotificationsRegistered,
        bool echoNotificationToFallback = false)
    {
        _writeLog = writeLog;
        _showFallbackNotification = showFallbackNotification;
        _windowsNotificationsRegistered = windowsNotificationsRegistered;
        _echoNotificationToFallback = echoNotificationToFallback;
    }

    public async Task CheckAsync(
        bool showStatusWhenNoVideos,
        bool includeAlreadySeen,
        CancellationToken cancellationToken)
    {
        _writeLog("Checking recent videos.");
        var settings = SettingsService.Load();
        if (string.IsNullOrWhiteSpace(settings.YouTubeApiKey))
        {
            const string message = "Missing YouTube API key. Add settings.json or set YOUTUBE_BETA_YOUTUBE_API_KEY.";
            _writeLog(message);
            if (showStatusWhenNoVideos)
            {
                _showFallbackNotification("Youtube Beta", message);
            }

            return;
        }

        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(45)
        };

        var configService = new ConfigService(httpClient, settings.ConfigUrl, CachePaths.CachedConfigPath);
        var configResult = await configService.LoadAsync(cancellationToken).ConfigureAwait(false);
        if (!configResult.HasUsableConfig)
        {
            _writeLog($"No usable config for recent video check. {configResult.Message}");
            if (showStatusWhenNoVideos)
            {
                _showFallbackNotification("Youtube Beta", configResult.Message);
            }

            return;
        }

        var feedService = new FeedService(new YouTubeDataApiClient(httpClient));
        var videos = await feedService.LoadFeedAsync(configResult.Config, settings.YouTubeApiKey, cancellationToken)
            .ConfigureAwait(false);

        var state = LoadState();
        var shownIds = state.ShownVideoIds.ToHashSet(StringComparer.Ordinal);
        var cutoff = DateTimeOffset.Now.Date.AddDays(-1);
        var recentVideosSinceYesterday = videos
            .Where(video => video.PublishedAt >= cutoff)
            .OrderByDescending(video => video.PublishedAt)
            .ToArray();
        var recentUnseenVideos = recentVideosSinceYesterday
            .Where(video => !shownIds.Contains(video.VideoId))
            .ToArray();
        var videosToShow = includeAlreadySeen ? recentVideosSinceYesterday : recentUnseenVideos;

        SaveState(state with { LastCheckedAtUtc = DateTimeOffset.UtcNow });

        if (videosToShow.Length == 0)
        {
            var message = includeAlreadySeen
                ? "No recent videos found since yesterday."
                : "No unannounced recent videos found since yesterday.";
            _writeLog(message);
            if (showStatusWhenNoVideos)
            {
                _showFallbackNotification("Youtube Beta", message);
            }

            return;
        }

        var recentVideos = videosToShow.Take(MaxVideosToNotify).ToArray();
        ShowRecentVideoNotification(recentVideos);
        var seenVideosToPersist = includeAlreadySeen ? recentVideosSinceYesterday : recentUnseenVideos;
        if (seenVideosToPersist.Length > 0)
        {
            SaveState(new RecentVideoNotifierState
            {
                LastCheckedAtUtc = DateTimeOffset.UtcNow,
                ShownVideoIds = shownIds
                    .Concat(seenVideosToPersist.Select(video => video.VideoId))
                    .Distinct(StringComparer.Ordinal)
                    .TakeLast(200)
                    .ToArray()
            });
        }

        if (includeAlreadySeen)
        {
            _writeLog($"Showed {recentVideos.Length} latest recent videos manually and marked {seenVideosToPersist.Length} recent videos as seen.");
        }
        else
        {
            _writeLog($"Notified {recentVideos.Length} recent videos and marked {seenVideosToPersist.Length} recent videos as seen.");
        }
    }

    private void ShowRecentVideoNotification(IReadOnlyList<VideoItem> videos)
    {
        var title = videos.Count == 1 ? "New video is ready" : "New videos are ready";
        var lines = videos
            .Select(video => string.IsNullOrWhiteSpace(video.ChannelTitle)
                ? video.Title
                : $"{video.Title} - {video.ChannelTitle}")
            .ToArray();
        var message = string.Join(Environment.NewLine, lines);

        if (_windowsNotificationsRegistered)
        {
            try
            {
                var builder = new AppNotificationBuilder()
                    .AddArgument("action", "open")
                    .AddText(title);

                foreach (var line in lines)
                {
                    builder.AddText(line);
                }

                AppNotificationManager.Default.Show(builder.BuildNotification());
                _writeLog($"Showed Windows toast for {videos.Count} recent videos.");
                if (_echoNotificationToFallback)
                {
                    _showFallbackNotification(title, message);
                }

                return;
            }
            catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or System.Runtime.InteropServices.COMException)
            {
                _writeLog($"Recent video Windows toast failed: {ex.Message}");
            }
        }

        _showFallbackNotification(title, message);
        _writeLog($"Showed tray balloon for {videos.Count} recent videos.");
    }

    private static RecentVideoNotifierState LoadState()
    {
        try
        {
            if (!File.Exists(AppPaths.RecentVideoNotifierStatePath))
            {
                return new RecentVideoNotifierState();
            }

            using var stream = File.OpenRead(AppPaths.RecentVideoNotifierStatePath);
            return JsonSerializer.Deserialize<RecentVideoNotifierState>(stream, JsonDefaults.Options)
                ?? new RecentVideoNotifierState();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            Debug.WriteLine(ex);
            return new RecentVideoNotifierState();
        }
    }

    private static void SaveState(RecentVideoNotifierState state)
    {
        Directory.CreateDirectory(AppPaths.AppDataDirectory);
        File.WriteAllText(
            AppPaths.RecentVideoNotifierStatePath,
            JsonSerializer.Serialize(state, JsonDefaults.Options));
    }
}
