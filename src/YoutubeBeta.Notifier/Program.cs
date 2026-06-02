using System.Threading;
using System.Windows.Forms;
using Microsoft.Windows.ApplicationModel.DynamicDependency;

namespace YoutubeBeta.Notifier;

internal static class Program
{
    private const string MutexName = "Local\\YoutubeBeta.Notifier";

    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(true, MutexName, out var createdNew);
        if (!createdNew)
        {
            return;
        }

        var bootstrapped = false;
        try
        {
            Bootstrap.Initialize(0x00020001, "");
            bootstrapped = true;

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
        }
    }
}
