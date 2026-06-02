using System;
using YoutubeBeta.Models;
using YoutubeBeta.Services;
using Xunit;

namespace YoutubeBeta.Tests;

public sealed class FeedComposerTests
{
    [Fact]
    public void ApplyPolicy_hides_blocked_and_disabled_channel_videos()
    {
        var config = new AppConfig
        {
            Channels =
            [
                new ChannelConfig { ChannelId = "UC11111111111111111111", Enabled = true },
                new ChannelConfig { ChannelId = "UC22222222222222222222", Enabled = false }
            ],
            BlockedVideoIds = ["BBBBBBBBBBB"]
        };

        var videos = new[]
        {
            Video("AAAAAAAAAAA", "UC11111111111111111111", 3),
            Video("BBBBBBBBBBB", "UC11111111111111111111", 2),
            Video("CCCCCCCCCCC", "UC22222222222222222222", 1)
        };

        var result = FeedComposer.ApplyPolicy(config, videos);

        Assert.Collection(result, item => Assert.Equal("AAAAAAAAAAA", item.VideoId));
    }

    [Fact]
    public void ApplyPolicy_places_pinned_videos_first_in_config_order()
    {
        var config = new AppConfig
        {
            Channels =
            [
                new ChannelConfig { ChannelId = "UC11111111111111111111", Enabled = true }
            ],
            PinnedVideoIds = ["CCCCCCCCCCC", "AAAAAAAAAAA"]
        };

        var videos = new[]
        {
            Video("AAAAAAAAAAA", "UC11111111111111111111", 1),
            Video("BBBBBBBBBBB", "UC11111111111111111111", 3),
            Video("CCCCCCCCCCC", "UC11111111111111111111", 2)
        };

        var result = FeedComposer.ApplyPolicy(config, videos);

        Assert.Collection(
            result,
            item => Assert.Equal("CCCCCCCCCCC", item.VideoId),
            item => Assert.Equal("AAAAAAAAAAA", item.VideoId),
            item => Assert.Equal("BBBBBBBBBBB", item.VideoId));
    }

    [Fact]
    public void ApplyPolicy_allows_pinned_video_even_when_channel_is_not_enabled()
    {
        var config = new AppConfig
        {
            Channels = [],
            PinnedVideoIds = ["AAAAAAAAAAA"]
        };

        var result = FeedComposer.ApplyPolicy(
            config,
            [Video("AAAAAAAAAAA", "UC99999999999999999999", 1)]);

        Assert.Collection(result, item => Assert.True(item.IsPinned));
    }

    [Fact]
    public void ApplyChannelPolicy_returns_only_unblocked_videos_for_selected_channel()
    {
        var config = new AppConfig
        {
            BlockedVideoIds = ["BBBBBBBBBBB"],
            PinnedVideoIds = ["AAAAAAAAAAA"]
        };

        var result = FeedComposer.ApplyChannelPolicy(
            config,
            "UC11111111111111111111",
            [
                Video("AAAAAAAAAAA", "UC11111111111111111111", 2),
                Video("BBBBBBBBBBB", "UC11111111111111111111", 1),
                Video("CCCCCCCCCCC", "UC22222222222222222222", 3)
            ]);

        Assert.Collection(
            result,
            item =>
            {
                Assert.Equal("AAAAAAAAAAA", item.VideoId);
                Assert.True(item.IsPinned);
            });
    }

    private static VideoItem Video(string videoId, string channelId, int daysAgo)
    {
        return new VideoItem
        {
            VideoId = videoId,
            ChannelId = channelId,
            ChannelTitle = "Channel",
            Title = videoId,
            PublishedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo)
        };
    }
}
