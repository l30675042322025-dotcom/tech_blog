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
@TableName("operation_logs")
public class OperationLogEntity implements CreateTimeAware {
  @TableId(type = IdType.AUTO)
  private Long id;

  @TableField("operator_id")
  private Long operatorId;

  @TableField("operator_name")
  private String operatorName;

  @TableField("operation_name")
  private String operationName;

  @TableField("operation_target")
  private String operationTarget;

  @TableField("is_success")
  private Boolean success;

  @TableField("error_message")
  private String errorMessage;

  @TableField("created_at")
  private LocalDateTime createdAt;
}
