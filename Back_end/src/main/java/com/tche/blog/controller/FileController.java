package com.tche.blog.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tche.blog.common.BusinessException;
import com.tche.blog.service.ObjectStorageService;

@RestController
@RequestMapping("/api/files")
public class FileController {
  @jakarta.annotation.Resource
  private ObjectStorageService objectStorageService;

  @GetMapping("/{folder}/{fileName:.+}")
  public ResponseEntity<Resource> getFile(@PathVariable String folder, @PathVariable String fileName) {
    Path path = objectStorageService.resolvePath(folder, fileName);
    if (!Files.exists(path) || Files.isDirectory(path)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "file not found");
    }

    MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
    try {
      String probe = Files.probeContentType(path);
      if (probe != null && !probe.isBlank()) {
        mediaType = MediaType.parseMediaType(probe);
      }
    } catch (IOException ignored) {
      // keep fallback media type
    }

    Resource resource = new FileSystemResource(path.toFile());
    return ResponseEntity
      .ok()
      .contentType(mediaType)
      .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
      .body(resource);
  }
}
