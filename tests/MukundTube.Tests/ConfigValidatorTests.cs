using MukundTube.Models;
using MukundTube.Services;

namespace MukundTube.Tests;

public sealed class ConfigValidatorTests
{
    [Fact]
    public void Validate_accepts_minimal_valid_config()
    {
        var config = new AppConfig
        {
            Version = 1,
            UpdatedAt = DateTimeOffset.UtcNow,
            RefreshIntervalMinutes = 60,
            MaxVideosPerChannel = 25,
            Channels =
            [
                new ChannelConfig
                {
                    ChannelId = "UC12345678901234567890",
                    Title = "Safe Channel",
                    Enabled = true
                }
            ],
            BlockedVideoIds = ["A1234567890"],
            PinnedVideoIds = ["B1234567890"]
        };

        var errors = ConfigValidator.Validate(config);

        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_rejects_handles_instead_of_channel_ids()
    {
        var config = new AppConfig
        {
            Version = 1,
            Channels =
            [
                new ChannelConfig
                {
                    ChannelId = "@somehandle",
                    Title = "Handle",
                    Enabled = true
                }
            ]
        };

        var errors = ConfigValidator.Validate(config);

        Assert.Contains(errors, error => error.Contains("Invalid channelId", StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_rejects_bad_video_ids()
    {
        var config = new AppConfig
        {
            Version = 1,
            BlockedVideoIds = ["not-a-valid-video-id"]
        };

        var errors = ConfigValidator.Validate(config);

        Assert.Contains(errors, error => error.Contains("Invalid video ID", StringComparison.Ordinal));
    }
}

