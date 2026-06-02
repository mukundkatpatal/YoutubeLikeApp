using System;
using System.IO;
using System.Text.Json;
using YoutubeBeta.Models;

namespace YoutubeBeta.Services;

public static class SettingsService
{
    public static UserSettings Load()
    {
        var settings = new UserSettings();

        settings = Merge(settings, TryLoad(Path.Combine(AppContext.BaseDirectory, "settings.local.json")));
        settings = Merge(settings, TryLoad(CachePaths.UserSettingsPath));

        var apiKey = Environment.GetEnvironmentVariable("YOUTUBE_BETA_YOUTUBE_API_KEY");
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            settings = settings with { YouTubeApiKey = apiKey };
        }

        var configUrl = Environment.GetEnvironmentVariable("YOUTUBE_BETA_CONFIG_URL");
        if (!string.IsNullOrWhiteSpace(configUrl))
        {
            settings = settings with { ConfigUrl = configUrl };
        }

        var updateManifestUrl = Environment.GetEnvironmentVariable("YOUTUBE_BETA_UPDATE_MANIFEST_URL");
        if (!string.IsNullOrWhiteSpace(updateManifestUrl))
        {
            settings = settings with { UpdateManifestUrl = updateManifestUrl };
        }

        var referrer = Environment.GetEnvironmentVariable("YOUTUBE_BETA_APP_REFERRER");
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
            UpdateManifestUrl = string.IsNullOrWhiteSpace(loaded.UpdateManifestUrl) ? current.UpdateManifestUrl : loaded.UpdateManifestUrl,
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
