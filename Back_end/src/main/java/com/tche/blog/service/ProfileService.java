package com.tche.blog.service;

import org.springframework.web.multipart.MultipartFile;

import com.tche.blog.dto.UserView;
import com.tche.blog.dto.profile.AvatarUploadResponse;
import com.tche.blog.dto.profile.ProfileUpdateRequest;
import com.tche.blog.model.UserEntity;

public interface ProfileService {
  UserView getProfile(UserEntity user);
  UserView updateProfile(UserEntity user, ProfileUpdateRequest request);
  AvatarUploadResponse uploadAvatar(UserEntity user, MultipartFile file);
}
