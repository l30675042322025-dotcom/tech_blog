package com.tche.blog.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.ApiResponse;
import com.tche.blog.dto.music.MusicTrackResponse;
import com.tche.blog.service.MusicService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
public class MusicController {
  private final MusicService musicService;

  @GetMapping("/tracks")
  public ApiResponse<List<MusicTrackResponse>> listTracks() {
    return ApiResponse.ok(musicService.listTracks());
  }

  @GetMapping("/files/{fileName:.+}")
  public ResponseEntity<Resource> streamMusic(@PathVariable String fileName) throws IOException {
    Path path = musicService.resolveTrackPath(fileName);
    MediaType mediaType = resolveMediaType(path);
    Resource resource = new FileSystemResource(path.toFile());
    return ResponseEntity
      .ok()
      .contentType(mediaType)
      .contentLength(Files.size(path))
      .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
      .header(HttpHeaders.ACCEPT_RANGES, "bytes")
      .body(resource);
  }

  private MediaType resolveMediaType(Path path) {
    try {
      String contentType = Files.probeContentType(path);
      if (contentType != null && !contentType.isBlank()) {
        return MediaType.parseMediaType(contentType);
      }
    } catch (IOException ignored) {
      // fallback to octet-stream
    }
    return MediaType.APPLICATION_OCTET_STREAM;
  }
}
