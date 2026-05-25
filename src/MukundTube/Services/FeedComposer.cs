using MukundTube.Models;

namespace MukundTube.Services;

public static class FeedComposer
{
    public static IReadOnlyList<VideoItem> ApplyChannelPolicy(
        AppConfig config,
        string channelId,
        IEnumerable<VideoItem> candidateVideos)
    {
        var blockedVideoIds = config.BlockedVideoIds.ToHashSet(StringComparer.Ordinal);
        var pinnedVideoIds = config.PinnedVideoIds.ToHashSet(StringComparer.Ordinal);

        return candidateVideos
            .Where(video => !string.IsNullOrWhiteSpace(video.VideoId))
            .Where(video => string.Equals(video.ChannelId, channelId, StringComparison.Ordinal))
            .Where(video => !blockedVideoIds.Contains(video.VideoId))
            .GroupBy(video => video.VideoId, StringComparer.Ordinal)
            .Select(group => group
                .OrderByDescending(video => pinnedVideoIds.Contains(video.VideoId))
                .ThenByDescending(video => video.PublishedAt)
                .First())
            .Select(video => video with { IsPinned = pinnedVideoIds.Contains(video.VideoId) })
            .OrderByDescending(video => video.IsPinned)
            .ThenBy(video => PinnedIndex(video.VideoId, config.PinnedVideoIds))
            .ThenByDescending(video => video.PublishedAt)
            .ToArray();
    }

    public static IReadOnlyList<VideoItem> ApplyPolicy(AppConfig config, IEnumerable<VideoItem> candidateVideos)
    {
        var enabledChannelIds = config.Channels
            .Where(channel => channel.Enabled)
            .Select(channel => channel.ChannelId)
            .ToHashSet(StringComparer.Ordinal);

        var blockedVideoIds = config.BlockedVideoIds.ToHashSet(StringComparer.Ordinal);
        var pinnedVideoIds = config.PinnedVideoIds.ToHashSet(StringComparer.Ordinal);

        return candidateVideos
            .Where(video => !string.IsNullOrWhiteSpace(video.VideoId))
            .Where(video => !blockedVideoIds.Contains(video.VideoId))
            .Where(video => enabledChannelIds.Contains(video.ChannelId) || pinnedVideoIds.Contains(video.VideoId))
            .GroupBy(video => video.VideoId, StringComparer.Ordinal)
            .Select(group => group
                .OrderByDescending(video => pinnedVideoIds.Contains(video.VideoId))
                .ThenByDescending(video => video.PublishedAt)
                .First())
            .Select(video => video with { IsPinned = pinnedVideoIds.Contains(video.VideoId) })
            .OrderByDescending(video => video.IsPinned)
            .ThenBy(video => PinnedIndex(video.VideoId, config.PinnedVideoIds))
            .ThenByDescending(video => video.PublishedAt)
            .ToArray();
    }

    private static int PinnedIndex(string videoId, IReadOnlyList<string> pinnedVideoIds)
    {
        for (var index = 0; index < pinnedVideoIds.Count; index++)
        {
            if (string.Equals(pinnedVideoIds[index], videoId, StringComparison.Ordinal))
            {
                return index;
            }
        }

        return int.MaxValue;
    }
}
