package com.tche.blog.service.impl;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tche.blog.aop.TrackOperation;
import com.tche.blog.common.BusinessException;
import com.tche.blog.dto.UserView;
import com.tche.blog.dto.profile.AvatarUploadResponse;
import com.tche.blog.dto.profile.ProfileUpdateRequest;
import com.tche.blog.mapper.UserMapper;
import com.tche.blog.model.StorageRecord;
import com.tche.blog.model.UserEntity;
import com.tche.blog.service.ActivityLogService;
import com.tche.blog.service.ObjectStorageService;
import com.tche.blog.service.ProfileService;
import com.tche.blog.service.ViewMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProfileServiceImpl implements ProfileService {
  private final UserMapper userMapper;
  private final ObjectStorageService objectStorageService;
  private final ActivityLogService activityLogService;

  @Override
  public UserView getProfile(UserEntity user) {
    UserEntity latest = userMapper.selectById(user.getId());
    if (latest == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "user not found");
    }
    return ViewMapper.user(latest);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "profile_update", target = "user")
  public UserView updateProfile(UserEntity user, ProfileUpdateRequest request) {
    UserEntity latest = userMapper.selectById(user.getId());
    if (latest == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "user not found");
    }

    if (request.name() != null && !request.name().isBlank()) {
      String nextName = request.name().trim();
      long count = userMapper.selectCount(
        new LambdaQueryWrapper<UserEntity>()
          .eq(UserEntity::getUsername, nextName)
          .ne(UserEntity::getId, latest.getId())
      );
      if (count > 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "username already exists");
      }
      latest.setUsername(nextName);
    }

    if (request.email() != null && !request.email().isBlank()) {
      String nextEmail = request.email().trim().toLowerCase();
      long count = userMapper.selectCount(
        new LambdaQueryWrapper<UserEntity>()
          .eq(UserEntity::getEmail, nextEmail)
          .ne(UserEntity::getId, latest.getId())
      );
      if (count > 0) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "email already exists");
      }
      latest.setEmail(nextEmail);
    }

    if (request.nickname() != null) {
      latest.setNickname(request.nickname().trim());
    }
    if (request.mobile() != null) {
      latest.setMobile(request.mobile().trim());
    }
    if (request.bio() != null) {
      latest.setBio(request.bio().trim());
    }
    if (request.github() != null) {
      latest.setGithub(request.github().trim());
    }
    if (request.twitter() != null) {
      latest.setTwitter(request.twitter().trim());
    }
    if (request.website() != null) {
      latest.setWebsite(request.website().trim());
    }

    userMapper.updateById(latest);
    activityLogService.log("profile_update", latest.getId(), Map.of("name", latest.getUsername()));
    return ViewMapper.user(latest);
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  @TrackOperation(name = "avatar_update", target = "avatar")
  public AvatarUploadResponse uploadAvatar(UserEntity user, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "avatar file is required");
    }

    StorageRecord record;
    try {
      record = objectStorageService.saveAvatar(file);
    } catch (IOException e) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "avatar upload failed: " + e.getMessage());
    }

    UserEntity latest = userMapper.selectById(user.getId());
    if (latest == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "user not found");
    }

    latest.setAvatarUrl(record.publicUrl());
    latest.setLastAvatarObjectKey(record.objectKey());
    userMapper.updateById(latest);

    activityLogService.log(
      "avatar_update",
      latest.getId(),
      Map.of("objectKey", record.objectKey(), "fileName", record.fileName())
    );

    return new AvatarUploadResponse(record.publicUrl(), record.objectKey(), record.fileName());
  }
}
