package com.tche.blog.service.impl;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

import com.tche.blog.common.BusinessException;
import com.tche.blog.config.MusicProperties;
import com.tche.blog.dto.music.MusicLyricLineResponse;
import com.tche.blog.dto.music.MusicTrackResponse;
import com.tche.blog.service.MusicService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MusicServiceImpl implements MusicService {
  private static final Set<String> SUPPORTED_AUDIO_EXTENSIONS = Set.of("mp3", "wav", "ogg", "m4a", "flac", "aac");
  private static final Pattern LRC_TIME_TAG_PATTERN = Pattern.compile("\\[(\\d{1,2}):(\\d{1,2})(?:\\.(\\d{1,3}))?\\]");

  private final MusicProperties musicProperties;

  @Override
  public List<MusicTrackResponse> listTracks() {
    if (!musicProperties.isEnabled()) {
      return List.of();
    }

    Path rootPath = musicRootPath();
    if (!Files.exists(rootPath) || !Files.isDirectory(rootPath)) {
      return List.of();
    }

    int maxTracks = Math.max(1, musicProperties.getMaxTracks());
    List<Path> audioFiles = new ArrayList<>();
    try (Stream<Path> stream = Files.list(rootPath)) {
      stream
        .filter(Files::isRegularFile)
        .filter(this::isSupportedAudioFile)
        .sorted(Comparator.comparing(path -> path.getFileName().toString().toLowerCase(Locale.ROOT)))
        .limit(maxTracks)
        .forEach(audioFiles::add);
    } catch (IOException ex) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to scan local music files");
    }

    return audioFiles
      .stream()
      .map(path -> {
        String fileName = path.getFileName().toString();
        String title = extractBaseName(fileName);
        Path lyricPath = path.resolveSibling(title + ".lrc");
        List<MusicLyricLineResponse> lyrics = parseLyrics(lyricPath, title);
        String streamPath = "/music/files/" + UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8);
        return new MusicTrackResponse(fileName, title, fileName, streamPath, lyrics);
      })
      .toList();
  }

  @Override
  public Path resolveTrackPath(String fileName) {
    if (!musicProperties.isEnabled()) {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "music playback is disabled");
    }

    String normalizedFileName = normalizeFileName(fileName);
    if (normalizedFileName.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "file name is required");
    }

    Path rootPath = musicRootPath().normalize();
    Path resolvedPath = rootPath.resolve(normalizedFileName).normalize();
    if (!resolvedPath.startsWith(rootPath)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "invalid music file path");
    }
    if (!Files.exists(resolvedPath) || Files.isDirectory(resolvedPath)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "music file not found");
    }
    if (!isSupportedAudioFile(resolvedPath)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "unsupported music file format");
    }
    return resolvedPath;
  }

  private Path musicRootPath() {
    String configuredRoot = normalizeText(musicProperties.getLocalRoot());
    if (configuredRoot.isBlank()) {
      return Paths.get("../Songs");
    }
    return Paths.get(configuredRoot);
  }

  private boolean isSupportedAudioFile(Path path) {
    String fileName = normalizeText(path == null || path.getFileName() == null ? "" : path.getFileName().toString());
    int lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot >= fileName.length() - 1) {
      return false;
    }
    String extension = fileName.substring(lastDot + 1).toLowerCase(Locale.ROOT);
    return SUPPORTED_AUDIO_EXTENSIONS.contains(extension);
  }

  private String normalizeText(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeFileName(String fileName) {
    String normalized = normalizeText(fileName);
    if (normalized.isBlank()) {
      return "";
    }
    String simpleName = Paths.get(normalized).getFileName().toString();
    return normalizeText(simpleName);
  }

  private String extractBaseName(String fileName) {
    String normalized = normalizeText(fileName);
    int lastDot = normalized.lastIndexOf('.');
    if (lastDot <= 0) {
      return normalized;
    }
    return normalized.substring(0, lastDot);
  }

  private List<MusicLyricLineResponse> parseLyrics(Path lrcPath, String fallbackText) {
    if (lrcPath == null || !Files.exists(lrcPath) || Files.isDirectory(lrcPath)) {
      return List.of(new MusicLyricLineResponse(0, fallbackText));
    }

    List<String> rawLines;
    try {
      rawLines = Files.readAllLines(lrcPath, StandardCharsets.UTF_8);
    } catch (IOException ex) {
      return List.of(new MusicLyricLineResponse(0, fallbackText));
    }

    List<MusicLyricLineResponse> lyricLines = new ArrayList<>();
    Set<String> dedupe = new HashSet<>();
    for (String rawLine : rawLines) {
      if (rawLine == null || rawLine.isBlank()) {
        continue;
      }

      Matcher matcher = LRC_TIME_TAG_PATTERN.matcher(rawLine);
      List<Long> times = new ArrayList<>();
      int contentStart = -1;
      while (matcher.find()) {
        times.add(toMillisecond(matcher.group(1), matcher.group(2), matcher.group(3)));
        contentStart = matcher.end();
      }

      if (times.isEmpty() || contentStart < 0) {
        continue;
      }

      String text = rawLine.substring(contentStart).trim();
      if (text.isBlank()) {
        continue;
      }

      for (Long timeMs : times) {
        if (timeMs == null || timeMs < 0) {
          continue;
        }
        String key = timeMs + "|" + text;
        if (!dedupe.add(key)) {
          continue;
        }
        lyricLines.add(new MusicLyricLineResponse(timeMs, text));
      }
    }

    if (lyricLines.isEmpty()) {
      return List.of(new MusicLyricLineResponse(0, fallbackText));
    }

    lyricLines.sort(Comparator.comparingLong(MusicLyricLineResponse::timeMs));
    return lyricLines;
  }

  private long toMillisecond(String minuteText, String secondText, String milliText) {
    long minute = parseLongSafe(minuteText);
    long second = parseLongSafe(secondText);
    long millisecond = normalizeMillisecond(milliText);
    return minute * 60_000L + second * 1_000L + millisecond;
  }

  private long parseLongSafe(String value) {
    try {
      return Long.parseLong(value);
    } catch (NumberFormatException ex) {
      return 0L;
    }
  }

  private long normalizeMillisecond(String milliText) {
    String normalized = normalizeText(milliText);
    if (normalized.isBlank()) {
      return 0L;
    }
    if (normalized.length() == 1) {
      normalized = normalized + "00";
    } else if (normalized.length() == 2) {
      normalized = normalized + "0";
    } else if (normalized.length() > 3) {
      normalized = normalized.substring(0, 3);
    }
    return parseLongSafe(normalized);
  }
}
