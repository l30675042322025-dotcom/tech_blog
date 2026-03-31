package com.tche.blog.model;

import java.time.LocalDateTime;

import com.baomidou.mybatisplus.annotation.IdType;
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
@TableName("article_likes")
public class ArticleLikeEntity implements CreateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  @TableField("article_id")
  private Long articleId;

  @TableField("user_id")
  private Long userId;

  @TableField("created_at")
  private LocalDateTime createdAt;
}
