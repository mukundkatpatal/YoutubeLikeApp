using MukundTube.Models;

namespace MukundTube.Services;

public sealed class FeedService
{
    private readonly YouTubeDataApiClient _youTube;

    public FeedService(YouTubeDataApiClient youTube)
    {
        _youTube = youTube;
    }

    public async Task<IReadOnlyList<VideoItem>> LoadFeedAsync(
        AppConfig config,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var candidateVideos = new List<VideoItem>();

        foreach (var channel in config.Channels.Where(channel => channel.Enabled))
        {
            var videos = await _youTube.GetLatestChannelVideosAsync(
                channel.ChannelId,
                config.MaxVideosPerChannel,
                apiKey,
                cancellationToken).ConfigureAwait(false);

            candidateVideos.AddRange(videos);
        }

        if (config.PinnedVideoIds.Count > 0)
        {
            var pinnedVideos = await _youTube.GetVideosByIdsAsync(
                config.PinnedVideoIds,
                apiKey,
                cancellationToken).ConfigureAwait(false);

            candidateVideos.AddRange(pinnedVideos);
        }

        return FeedComposer.ApplyPolicy(config, candidateVideos);
    }

    public async Task<IReadOnlyList<ChannelItem>> LoadChannelsAsync(
        AppConfig config,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var channels = await _youTube.GetChannelsAsync(config.Channels, apiKey, cancellationToken)
            .ConfigureAwait(false);

        var enrichedChannels = await Task.WhenAll(channels.Select(async channel =>
        {
            var videos = await LoadChannelPreviewVideosAsync(config, channel, apiKey, cancellationToken)
                .ConfigureAwait(false);

            var latestVideo = videos.FirstOrDefault();
            return channel with
            {
                ThumbnailUrl = string.IsNullOrWhiteSpace(channel.ThumbnailUrl)
                    ? latestVideo?.ThumbnailUrl ?? ""
                    : channel.ThumbnailUrl,
                LatestPublishedAt = latestVideo?.PublishedAt ?? DateTimeOffset.MinValue
            };
        })).ConfigureAwait(false);

        return enrichedChannels
            .OrderByDescending(channel => channel.LatestPublishedAt)
            .ToArray();
    }

    public async Task<IReadOnlyList<VideoItem>> LoadChannelVideosAsync(
        AppConfig config,
        ChannelItem channel,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var videos = await _youTube.GetLatestChannelVideosAsync(
            channel.ChannelId,
            config.MaxVideosPerChannel,
            apiKey,
            cancellationToken).ConfigureAwait(false);

        return FeedComposer.ApplyChannelPolicy(config, channel.ChannelId, videos);
    }

    private async Task<IReadOnlyList<VideoItem>> LoadChannelPreviewVideosAsync(
        AppConfig config,
        ChannelItem channel,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var videos = await _youTube.GetLatestChannelVideosAsync(
            channel.ChannelId,
            Math.Min(config.MaxVideosPerChannel, 5),
            apiKey,
            cancellationToken).ConfigureAwait(false);

        return FeedComposer.ApplyChannelPolicy(config, channel.ChannelId, videos);
    }
}
