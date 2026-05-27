using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using MukundTube.Models;
using MukundTube.Services;

namespace MukundTube.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly ConfigService _configService;
    private readonly FeedService _feedService;
    private readonly UserSettings _settings;
    private bool _isLoading;
    private bool _isUpdateRequired;
    private string _statusText = "Starting...";
    private string _updateMessage = "";
    private string _updateDownloadUrl = "";
    private string _updateNotes = "";
    private ChannelItem? _selectedChannel;
    private VideoItem? _selectedVideo;

    public MainViewModel(ConfigService configService, FeedService feedService, UserSettings settings)
    {
        _configService = configService;
        _feedService = feedService;
        _settings = settings;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public ObservableCollection<ChannelItem> Channels { get; } = [];

    public ObservableCollection<VideoItem> Videos { get; } = [];

    public AppConfig CurrentConfig { get; private set; } = AppConfig.Empty;

    public bool IsLoading
    {
        get => _isLoading;
        private set => SetField(ref _isLoading, value);
    }

    public string StatusText
    {
        get => _statusText;
        set => SetField(ref _statusText, value);
    }

    public bool IsUpdateRequired
    {
        get => _isUpdateRequired;
        private set => SetField(ref _isUpdateRequired, value);
    }

    public string UpdateMessage
    {
        get => _updateMessage;
        private set => SetField(ref _updateMessage, value);
    }

    public string UpdateDownloadUrl
    {
        get => _updateDownloadUrl;
        private set => SetField(ref _updateDownloadUrl, value);
    }

    public string UpdateNotes
    {
        get => _updateNotes;
        private set => SetField(ref _updateNotes, value);
    }

    public VideoItem? SelectedVideo
    {
        get => _selectedVideo;
        set
        {
            if (SetField(ref _selectedVideo, value))
            {
                OnPropertyChanged(nameof(SelectedVideoTitle));
                OnPropertyChanged(nameof(SelectedVideoMeta));
            }
        }
    }

    public ChannelItem? SelectedChannel
    {
        get => _selectedChannel;
        set
        {
            if (SetField(ref _selectedChannel, value))
            {
                OnPropertyChanged(nameof(SelectedChannelTitle));
                OnPropertyChanged(nameof(IsChannelSelected));
            }
        }
    }

    public bool IsChannelSelected => SelectedChannel is not null;

    public string SelectedChannelTitle => SelectedChannel?.Title ?? "Channels";

    public bool HasVideos => Videos.Count > 0;

    public bool HasChannels => Channels.Count > 0;

    public string SelectedVideoTitle => SelectedVideo?.Title ?? "Choose an approved video";

    public string SelectedVideoMeta => SelectedVideo is null
        ? "The video list scrolls independently without resizing the player."
        : $"{SelectedVideo.ChannelTitle} - {SelectedVideo.PublishedAtText}";

    public void ApplyUpdateResult(UpdateCheckResult result)
    {
        if (!result.UpdateAvailable)
        {
            return;
        }

        IsUpdateRequired = true;
        UpdateMessage = $"Youtube Beta {result.LatestVersion} is available. Installed version: {result.CurrentVersion}.";
        UpdateDownloadUrl = result.DownloadUrl;
        UpdateNotes = result.Notes;
        StatusText = result.Message;
    }

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        if (IsLoading || IsUpdateRequired)
        {
            return;
        }

        IsLoading = true;
        StatusText = "Loading approved channels...";

        try
        {
            if (string.IsNullOrWhiteSpace(_settings.YouTubeApiKey))
            {
                Channels.Clear();
                Videos.Clear();
                SelectedChannel = null;
                SelectedVideo = null;
                OnPropertyChanged(nameof(HasChannels));
                OnPropertyChanged(nameof(HasVideos));
                StatusText = "Missing YouTube API key. Add settings.local.json beside the app or set MUKUND_TUBE_YOUTUBE_API_KEY.";
                return;
            }

            var configResult = await _configService.LoadAsync(cancellationToken).ConfigureAwait(true);
            CurrentConfig = configResult.Config;

            if (!configResult.HasUsableConfig)
            {
                Channels.Clear();
                Videos.Clear();
                SelectedChannel = null;
                SelectedVideo = null;
                OnPropertyChanged(nameof(HasChannels));
                OnPropertyChanged(nameof(HasVideos));
                StatusText = configResult.Message;
                return;
            }

            var channels = await _feedService.LoadChannelsAsync(CurrentConfig, _settings.YouTubeApiKey, cancellationToken)
                .ConfigureAwait(true);

            Channels.Clear();
            foreach (var channel in channels)
            {
                Channels.Add(channel);
            }

            Videos.Clear();
            SelectedChannel = null;
            SelectedVideo = null;

            OnPropertyChanged(nameof(HasChannels));
            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"{channels.Count} approved channels loaded. {configResult.Message}";
        }
        catch (OperationCanceledException)
        {
            StatusText = "Refresh cancelled.";
        }
        catch (Exception ex)
        {
            Channels.Clear();
            Videos.Clear();
            SelectedChannel = null;
            SelectedVideo = null;
            OnPropertyChanged(nameof(HasChannels));
            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"Could not load channels. {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task SelectChannelAsync(ChannelItem channel, CancellationToken cancellationToken)
    {
        if (IsLoading || IsUpdateRequired)
        {
            return;
        }

        IsLoading = true;
        SelectedChannel = channel;
        SelectedVideo = null;
        Videos.Clear();
        OnPropertyChanged(nameof(HasVideos));
        StatusText = $"Loading videos from {channel.Title}...";

        try
        {
            var videos = await _feedService.LoadChannelVideosAsync(CurrentConfig, channel, _settings.YouTubeApiKey, cancellationToken)
                .ConfigureAwait(true);

            Videos.Clear();
            foreach (var video in videos)
            {
                Videos.Add(video);
            }

            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"{videos.Count} approved videos loaded from {channel.Title}.";
        }
        catch (OperationCanceledException)
        {
            StatusText = "Channel load cancelled.";
        }
        catch (Exception ex)
        {
            Videos.Clear();
            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"Could not load channel videos. {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
