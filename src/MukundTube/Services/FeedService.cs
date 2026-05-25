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
}

