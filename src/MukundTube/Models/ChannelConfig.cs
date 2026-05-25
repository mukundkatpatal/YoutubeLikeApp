namespace MukundTube.Models;

public sealed record ChannelConfig
{
    public string ChannelId { get; init; } = "";

    public string Title { get; init; } = "";

    public bool Enabled { get; init; } = true;
}

