namespace YoutubeBeta.Notifier;

internal sealed record NotifierState
{
    public string LastShownEventId { get; init; } = "";
}
