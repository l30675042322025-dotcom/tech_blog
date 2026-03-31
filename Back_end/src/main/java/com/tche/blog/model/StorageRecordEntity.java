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
@TableName("storage_records")
public class StorageRecordEntity implements CreateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  @TableField("record_type")
  private String recordType;

  @TableField("object_key")
  private String objectKey;

  @TableField("aliyun_path")
  private String aliyunPath;

  @TableField("file_name")
  private String fileName;

  @TableField("date_key")
  private String dateKey;

  @TableField("file_index")
  private Integer fileIndex;

  @TableField("public_url")
  private String publicUrl;

  @TableField("payload_json")
  private String payloadJson;

  @TableField("created_at")
  private LocalDateTime createdAt;
}
