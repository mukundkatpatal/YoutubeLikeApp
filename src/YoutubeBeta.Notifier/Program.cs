using System.Threading;
using System.Windows.Forms;
using Microsoft.Windows.AppNotifications;
using Microsoft.Windows.ApplicationModel.DynamicDependency;

namespace YoutubeBeta.Notifier;

internal static class Program
{
    private const string MutexName = "Local\\YoutubeBeta.Notifier";

    [STAThread]
    private static void Main(string[] args)
    {
        var checkVideosOnly = args.Any(arg => string.Equals(arg, "--check-videos", StringComparison.OrdinalIgnoreCase));
        Mutex? mutex = null;

        var bootstrapped = false;
        try
        {
            Bootstrap.Initialize(0x00020001, "");
            bootstrapped = true;

            if (checkVideosOnly)
            {
                var notificationsRegistered = false;
                try
                {
                    AppNotificationManager.Default.Register();
                    notificationsRegistered = true;
                }
                catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or System.Runtime.InteropServices.COMException)
                {
                    NotifierApplicationContext.WriteLog($"Manual video check notifications unavailable: {ex.Message}");
                }

                var service = new RecentVideoNotificationService(
                    NotifierApplicationContext.WriteLog,
                    (title, message) =>
                    {
                        Console.WriteLine($"{title}: {message}");
                        return false;
                    },
                    notificationsRegistered,
                    echoNotificationToFallback: true);
                try
                {
                    service.CheckAsync(
                        showStatusWhenNoVideos: true,
                        includeAlreadySeen: true,
                        cancellationToken: CancellationToken.None).GetAwaiter().GetResult();
                }
                finally
                {
                    if (notificationsRegistered)
                    {
                        AppNotificationManager.Default.Unregister();
                    }
                }

                return;
            }

            mutex = new Mutex(true, MutexName, out var createdNew);
            if (!createdNew)
            {
                return;
            }

            ApplicationConfiguration.Initialize();
            using var context = new NotifierApplicationContext();
            Application.Run(context);
        }
        finally
        {
            if (bootstrapped)
            {
                Bootstrap.Shutdown();
            }

            mutex?.Dispose();
        }
    }
}
