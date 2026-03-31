package com.tche.blog.dto.article;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ArticleBatchDeleteRequest(
  @JsonAlias("ids")
  @NotEmpty(message = "articleIds is required") List<@NotNull @Positive Long> articleIds
) {}
