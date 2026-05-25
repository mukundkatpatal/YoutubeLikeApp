namespace MukundTube.Models;

public sealed record VideoItem
{
    public string VideoId { get; init; } = "";

    public string Title { get; init; } = "";

    public string ChannelId { get; init; } = "";

    public string ChannelTitle { get; init; } = "";

    public DateTimeOffset PublishedAt { get; init; }

    public string ThumbnailUrl { get; init; } = "";

    public bool IsPinned { get; init; }

    public string PublishedAtText => PublishedAt == default
        ? ""
        : PublishedAt.ToLocalTime().ToString("g");
}

