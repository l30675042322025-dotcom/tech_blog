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
@TableName("essays")
public class EssayEntity implements CreateTimeAware, UpdateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  private String title;

  @TableField("content_path")
  private String contentPath;

  @TableField("author_id")
  private Long authorId;

  @TableField("author_name")
  private String authorName;

  private String location;

  @TableField("cover_image")
  private String coverImage;

  private Boolean hidden;

  @TableField("created_at")
  private LocalDateTime createdAt;

  @TableField("updated_at")
  private LocalDateTime updatedAt;
}
