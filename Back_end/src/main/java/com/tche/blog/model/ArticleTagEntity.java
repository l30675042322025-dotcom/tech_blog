package com.tche.blog.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@TableName("article_tags")
public class ArticleTagEntity {
  @TableId(type = IdType.AUTO)
  private Long id;

  @TableField("article_id")
  private Long articleId;

  @TableField("tag_name")
  private String tagName;
}
