namespace MukundTube.Notifier;

internal sealed record NotifierState
{
    public string LastShownEventId { get; init; } = "";
}
