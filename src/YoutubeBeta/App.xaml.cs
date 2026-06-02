using System.IO;
using System.Windows;
using System.Windows.Threading;
using YoutubeBeta.Services;

namespace YoutubeBeta;

public partial class App : Application
{
    private bool _isShowingFatalError;

    protected override void OnStartup(StartupEventArgs e)
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        base.OnStartup(e);
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        e.Handled = true;
        ShowFatalError(e.Exception);
        Shutdown(1);
    }

    private void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception exception)
        {
            Dispatcher.Invoke(() => ShowFatalError(exception));
        }
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        e.SetObserved();
        Dispatcher.Invoke(() => ShowFatalError(e.Exception));
    }

    private void ShowFatalError(Exception exception)
    {
        if (_isShowingFatalError)
        {
            return;
        }

        _isShowingFatalError = true;
        var message = $"""
            Youtube Beta hit an unexpected error.

            Copy this message and share it with Codex:

            {exception}
            """;

        WriteCrashLog(message);
        MessageBox.Show(
            message,
            "Youtube Beta error",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
    }

    private static void WriteCrashLog(string message)
    {
        try
        {
            Directory.CreateDirectory(CachePaths.AppDataDirectory);
            File.WriteAllText(CachePaths.CrashLogPath, message);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}

