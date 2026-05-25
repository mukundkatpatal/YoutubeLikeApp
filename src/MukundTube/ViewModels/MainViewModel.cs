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
    private string _statusText = "Starting...";
    private VideoItem? _selectedVideo;

    public MainViewModel(ConfigService configService, FeedService feedService, UserSettings settings)
    {
        _configService = configService;
        _feedService = feedService;
        _settings = settings;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

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

    public bool HasVideos => Videos.Count > 0;

    public string SelectedVideoTitle => SelectedVideo?.Title ?? "Choose an approved video";

    public string SelectedVideoMeta => SelectedVideo is null
        ? "The video list scrolls independently without resizing the player."
        : $"{SelectedVideo.ChannelTitle} - {SelectedVideo.PublishedAtText}";

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        if (IsLoading)
        {
            return;
        }

        IsLoading = true;
        StatusText = "Loading approved videos...";

        try
        {
            if (string.IsNullOrWhiteSpace(_settings.YouTubeApiKey))
            {
                Videos.Clear();
                OnPropertyChanged(nameof(HasVideos));
                StatusText = "Missing YouTube API key. Add settings.local.json beside the app or set MUKUND_TUBE_YOUTUBE_API_KEY.";
                return;
            }

            var configResult = await _configService.LoadAsync(cancellationToken).ConfigureAwait(true);
            CurrentConfig = configResult.Config;

            if (!configResult.HasUsableConfig)
            {
                Videos.Clear();
                SelectedVideo = null;
                OnPropertyChanged(nameof(HasVideos));
                StatusText = configResult.Message;
                return;
            }

            var videos = await _feedService.LoadFeedAsync(CurrentConfig, _settings.YouTubeApiKey, cancellationToken)
                .ConfigureAwait(true);

            Videos.Clear();
            foreach (var video in videos)
            {
                Videos.Add(video);
            }

            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"{videos.Count} approved videos loaded. {configResult.Message}";
        }
        catch (OperationCanceledException)
        {
            StatusText = "Refresh cancelled.";
        }
        catch (Exception ex)
        {
            Videos.Clear();
            SelectedVideo = null;
            OnPropertyChanged(nameof(HasVideos));
            StatusText = $"Could not load videos. {ex.Message}";
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
