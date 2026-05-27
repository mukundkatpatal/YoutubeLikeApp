namespace MukundTube.Services;

public static class CachePaths
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

    public static string CachedConfigPath => Path.Combine(AppDataDirectory, "last-good-config.json");

    public static string UserSettingsPath => Path.Combine(AppDataDirectory, "settings.json");
}
