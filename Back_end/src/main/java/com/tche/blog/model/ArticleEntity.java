package com.tche.blog.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
@TableName("articles")
public class ArticleEntity implements CreateTimeAware, UpdateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  private String title;
  private String summary;
  @TableField("summary_ai_generated")
  private boolean summaryAiGenerated;
  private String content;
  private String category;
  private String status;

  @TableField("cover_image")
  private String coverImage;

  @TableField("author_id")
  private Long authorId;

  @TableField("author_name")
  private String authorName;

  private int views;
  private int likes;

  @TableField("created_at")
  private LocalDateTime createdAt;

  @TableField("updated_at")
  private LocalDateTime updatedAt;

  @TableField(exist = false)
  private List<String> tags = new ArrayList<>();

  @TableField("publish_time")
  private LocalDateTime publishTime;
}
