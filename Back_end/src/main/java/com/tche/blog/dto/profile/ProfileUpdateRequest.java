package com.tche.blog.dto.profile;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
  @Size(max = 32, message = "name length must be <= 32")
  String name,
  @Email(message = "email format is invalid")
  String email,
  @Size(max = 32, message = "nickname length must be <= 32")
  String nickname,
  @Size(max = 32, message = "mobile length must be <= 32")
  String mobile,
  @Size(max = 500, message = "bio length must be <= 500")
  String bio,
  @Size(max = 128, message = "github length must be <= 128")
  String github,
  @Size(max = 128, message = "twitter length must be <= 128")
  String twitter,
  @Size(max = 128, message = "website length must be <= 128")
  String website
) {}
