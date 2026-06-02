namespace YoutubeBeta.Models;

public sealed record AppConfig
{
    public int Version { get; init; } = 1;

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;

    public int RefreshIntervalMinutes { get; init; } = 60;

    public int MaxVideosPerChannel { get; init; } = 25;

    public IReadOnlyList<ChannelConfig> Channels { get; init; } = [];

    public IReadOnlyList<string> BlockedVideoIds { get; init; } = [];

    public IReadOnlyList<string> PinnedVideoIds { get; init; } = [];

    public static AppConfig Empty { get; } = new()
    {
        Version = 1,
        UpdatedAt = DateTimeOffset.UnixEpoch,
        RefreshIntervalMinutes = 60,
        MaxVideosPerChannel = 25,
        Channels = [],
        BlockedVideoIds = [],
        PinnedVideoIds = []
    };
}

