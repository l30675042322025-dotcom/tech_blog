package com.tche.blog.dto.music;

import java.util.List;

public record MusicTrackResponse(
  String id,
  String title,
  String fileName,
  String streamPath,
  List<MusicLyricLineResponse> lyrics
) {}
