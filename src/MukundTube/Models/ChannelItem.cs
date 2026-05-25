namespace MukundTube.Models;

public sealed record ChannelItem
{
    public string ChannelId { get; init; } = "";

    public string Title { get; init; } = "";

    public string Description { get; init; } = "";

    public string ThumbnailUrl { get; init; } = "";

    public string UploadsPlaylistId { get; init; } = "";
}

