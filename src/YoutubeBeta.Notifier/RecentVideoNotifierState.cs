using System;

namespace YoutubeBeta.Notifier;

internal sealed record RecentVideoNotifierState
{
    public IReadOnlyList<string> ShownVideoIds { get; init; } = [];

    public DateTimeOffset LastCheckedAtUtc { get; init; }
}
