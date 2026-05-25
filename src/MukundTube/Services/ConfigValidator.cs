using MukundTube.Models;

namespace MukundTube.Services;

public static class ConfigValidator
{
    public static IReadOnlyList<string> Validate(AppConfig? config)
    {
        var errors = new List<string>();

        if (config is null)
        {
            return ["Config file could not be read as JSON."];
        }

        if (config.Version != 1)
        {
            errors.Add("Only config version 1 is supported.");
        }

        if (config.RefreshIntervalMinutes is < 1 or > 1440)
        {
            errors.Add("refreshIntervalMinutes must be between 1 and 1440.");
        }

        if (config.MaxVideosPerChannel is < 1 or > 200)
        {
            errors.Add("maxVideosPerChannel must be between 1 and 200.");
        }

        var channelIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var channel in config.Channels)
        {
            if (!LooksLikeChannelId(channel.ChannelId))
            {
                errors.Add($"Invalid channelId: '{channel.ChannelId}'. Use the UC... channel ID, not a handle URL.");
                continue;
            }

            if (!channelIds.Add(channel.ChannelId))
            {
                errors.Add($"Duplicate channelId: '{channel.ChannelId}'.");
            }
        }

        ValidateVideoIds(config.BlockedVideoIds, "blockedVideoIds", errors);
        ValidateVideoIds(config.PinnedVideoIds, "pinnedVideoIds", errors);

        return errors;
    }

    private static bool LooksLikeChannelId(string value)
    {
        return value.Length is >= 20 and <= 40
            && value.StartsWith("UC", StringComparison.Ordinal)
            && value.All(IsYouTubeIdCharacter);
    }

    private static void ValidateVideoIds(IEnumerable<string> videoIds, string fieldName, List<string> errors)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var videoId in videoIds)
        {
            if (videoId.Length != 11 || !videoId.All(IsYouTubeIdCharacter))
            {
                errors.Add($"Invalid video ID in {fieldName}: '{videoId}'.");
                continue;
            }

            if (!seen.Add(videoId))
            {
                errors.Add($"Duplicate video ID in {fieldName}: '{videoId}'.");
            }
        }
    }

    private static bool IsYouTubeIdCharacter(char value)
    {
        return char.IsAsciiLetterOrDigit(value) || value is '-' or '_';
    }
}
