package com.tche.blog.dto.category;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategorySummaryResponse {
  private Long id;
  private String name;
  private int articleCount;
}
