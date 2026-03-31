package com.tche.blog.model;

import java.time.LocalDateTime;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.tche.blog.model.audit.CreateTimeAware;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("user_tokens")
public class UserTokenEntity implements CreateTimeAware {
  @TableId
  private String token;

  @TableField("user_id")
  private Long userId;

  @TableField("issued_at")
  private LocalDateTime createdAt;

  @TableField("expires_at")
  private LocalDateTime expiresAt;

  @TableField("last_seen_at")
  private LocalDateTime lastSeenAt;
}
