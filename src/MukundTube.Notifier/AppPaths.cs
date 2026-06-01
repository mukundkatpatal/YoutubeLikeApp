using System;
using System.IO;

namespace MukundTube.Notifier;

internal static class AppPaths
{
    public const string AppFolderName = "Youtube Beta";

    public static string AppDataDirectory
    {
        get
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrWhiteSpace(localAppData))
            {
                localAppData = AppContext.BaseDirectory;
            }

            return Path.Combine(localAppData, AppFolderName);
        }
    }

    public static string PublishedAppDirectory => Path.Combine(AppDataDirectory, "App");

    public static string PublishedAppExePath => Path.Combine(PublishedAppDirectory, "Youtube Beta.exe");

    public static string UpdateStatePath => Path.Combine(AppDataDirectory, "update-state.json");

    public static string NotifierStatePath => Path.Combine(AppDataDirectory, "notifier-state.json");

    public static string NotifierLogPath => Path.Combine(AppDataDirectory, "notifier.log");

    public static string IconPath => Path.Combine(AppContext.BaseDirectory, "Assets", "Icons", "youtube-beta.ico");
}
