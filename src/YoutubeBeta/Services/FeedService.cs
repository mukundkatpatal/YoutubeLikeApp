using YoutubeBeta.Models;

namespace YoutubeBeta.Services;

public sealed class FeedService
{
    private const int ChannelDetailVideoLimit = 500;
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
        var maxResultsPerChannel = Math.Min(config.MaxVideosPerChannel, 10);
        using var concurrency = new SemaphoreSlim(4);

        var channelVideoTasks = config.Channels
            .Where(channel => channel.Enabled)
            .Select(async channel =>
            {
                await concurrency.WaitAsync(cancellationToken).ConfigureAwait(false);

                try
                {
                    return await _youTube.GetLatestChannelVideosAsync(
                        channel.ChannelId,
                        maxResultsPerChannel,
                        apiKey,
                        cancellationToken).ConfigureAwait(false);
                }
                catch (YouTubeApiException)
                {
                    return [];
                }
                finally
                {
                    concurrency.Release();
                }
            });

        var channelVideos = await Task.WhenAll(channelVideoTasks).ConfigureAwait(false);
        var candidateVideos = channelVideos.SelectMany(videos => videos).ToList();

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

        return channels
            .OrderBy(channel => channel.Title)
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
            Math.Max(config.MaxVideosPerChannel, ChannelDetailVideoLimit),
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
