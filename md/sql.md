## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Unique |
| `role` | `text` |  |
| `name` | `text` |  |
| `program` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `students`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `year` | `int4` |  Nullable |

## Table `ci_profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `specialization` | `text` |  Nullable |

## Table `hospitals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `address` | `text` |  Nullable |
| `latitude` | `float8` |  |
| `longitude` | `float8` |  |
| `attendance_radius` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `departments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `hospital_id` | `uuid` |  |
| `created_at` | `timestamptz` |  Nullable |

## Table `case_library`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `category` | `text` |  Nullable |
| `required_min` | `int4` |  |
| `program` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `schedules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `student_id` | `uuid` |  |
| `ci_id` | `uuid` |  |
| `hospital_id` | `uuid` |  |
| `department_id` | `uuid` |  |
| `date` | `date` |  |
| `start_time` | `time` |  |
| `end_time` | `time` |  |
| `case_type` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `open_slots`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `hospital_id` | `uuid` |  |
| `department_id` | `uuid` |  |
| `ci_id` | `uuid` |  |
| `date` | `date` |  |
| `start_time` | `time` |  |
| `end_time` | `time` |  |
| `case_type` | `text` |  Nullable |
| `max_students` | `int4` |  |
| `is_makeup` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `slot_applications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `slot_id` | `uuid` |  |
| `student_id` | `uuid` |  |
| `applied_at` | `timestamptz` |  Nullable |
| `status` | `text` |  |

## Table `case_progress`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `student_id` | `uuid` |  |
| `case_library_id` | `uuid` |  |
| `schedule_id` | `uuid` |  Nullable |
| `date_completed` | `date` |  |
| `notes` | `text` |  Nullable |
| `verified_by` | `uuid` |  Nullable |
| `verified_at` | `timestamptz` |  Nullable |
| `status` | `text` |  |
| `rejection_reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `attendance`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `schedule_id` | `uuid` |  |
| `student_id` | `uuid` |  |
| `time_in` | `timestamptz` |  Nullable |
| `time_out` | `timestamptz` |  Nullable |
| `gps_in` | `jsonb` |  Nullable |
| `gps_out` | `jsonb` |  Nullable |
| `face_verified` | `bool` |  Nullable |
| `liveness_passed` | `bool` |  Nullable |
| `status` | `text` |  |
| `verified_by` | `uuid` |  Nullable |
| `verification_method` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `message` | `text` |  |
| `read` | `bool` |  Nullable |
| `type` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `announcements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `sender_id` | `uuid` |  |
| `title` | `text` |  |
| `content` | `text` |  |
| `target_role` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `announcement_reads`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `announcement_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `read_at` | `timestamptz` |  Nullable |

## Table `audit_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `action` | `text` |  |
| `table_name` | `text` |  |
| `record_id` | `uuid` |  Nullable |
| `old_data` | `jsonb` |  Nullable |
| `new_data` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `recommendation_weights`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `criterion` | `text` |  Unique |
| `weight` | `int4` |  |
| `description` | `text` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

