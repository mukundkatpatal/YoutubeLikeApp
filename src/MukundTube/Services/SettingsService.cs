using System.Text.Json;
using MukundTube.Models;

namespace MukundTube.Services;

public static class SettingsService
{
    public static UserSettings Load()
    {
        var settings = new UserSettings();

        settings = Merge(settings, TryLoad(Path.Combine(AppContext.BaseDirectory, "settings.local.json")));
        settings = Merge(settings, TryLoad(CachePaths.UserSettingsPath));

        var apiKey = Environment.GetEnvironmentVariable("MUKUND_TUBE_YOUTUBE_API_KEY");
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            settings = settings with { YouTubeApiKey = apiKey };
        }

        var configUrl = Environment.GetEnvironmentVariable("MUKUND_TUBE_CONFIG_URL");
        if (!string.IsNullOrWhiteSpace(configUrl))
        {
            settings = settings with { ConfigUrl = configUrl };
        }

        var referrer = Environment.GetEnvironmentVariable("MUKUND_TUBE_APP_REFERRER");
        if (!string.IsNullOrWhiteSpace(referrer))
        {
            settings = settings with { AppReferrer = referrer };
        }

        return settings;
    }

    private static UserSettings Merge(UserSettings current, UserSettings? loaded)
    {
        if (loaded is null)
        {
            return current;
        }

        return current with
        {
            ConfigUrl = string.IsNullOrWhiteSpace(loaded.ConfigUrl) ? current.ConfigUrl : loaded.ConfigUrl,
            YouTubeApiKey = string.IsNullOrWhiteSpace(loaded.YouTubeApiKey) ? current.YouTubeApiKey : loaded.YouTubeApiKey,
            AppReferrer = string.IsNullOrWhiteSpace(loaded.AppReferrer) ? current.AppReferrer : loaded.AppReferrer
        };
    }

    private static UserSettings? TryLoad(string path)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<UserSettings>(json, JsonDefaults.Options);
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}

