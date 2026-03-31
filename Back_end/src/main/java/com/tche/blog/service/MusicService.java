package com.tche.blog.service;

import java.nio.file.Path;
import java.util.List;

import com.tche.blog.dto.music.MusicTrackResponse;

public interface MusicService {
  List<MusicTrackResponse> listTracks();
  Path resolveTrackPath(String fileName);
}
