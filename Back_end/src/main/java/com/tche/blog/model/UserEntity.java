package com.tche.blog.model;

import java.time.LocalDateTime;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.tche.blog.model.audit.CreateTimeAware;
import com.tche.blog.model.audit.UpdateTimeAware;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("users")
public class UserEntity implements CreateTimeAware, UpdateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  private String username;
  private String email;
  private String password;

  @TableField("avatar_url")
  private String avatarUrl;

  @TableField("last_avatar_object_key")
  private String lastAvatarObjectKey;

  private String nickname;
  private String mobile;
  private String bio;
  private String github;
  private String twitter;
  private String website;

  @TableField("created_at")
  private LocalDateTime createdAt;

  @TableField("updated_at")
  private LocalDateTime updatedAt;
}
