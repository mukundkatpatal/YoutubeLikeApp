using System;

namespace MukundTube.Notifier;

internal sealed record UpdateState
{
    public int SchemaVersion { get; init; }

    public string EventId { get; init; } = "";

    public string Status { get; init; } = "";

    public string Version { get; init; } = "";

    public DateTimeOffset PublishedAtUtc { get; init; }

    public string Message { get; init; } = "";

    public string AppExePath { get; init; } = "";
}
