import { AggregateRoot } from "@/shared/kernel/entities/aggregate-root";
import { Identifier } from "@/shared/kernel/value-objects/identifier.vo";
import { ProjectStatus } from "./project-status.enum";
import type { Nullable } from "@/shared/kernel/types/common.types";

interface ProjectProps {
  name: string;
  description: Nullable<string>;
  status: ProjectStatus;
  previewUrl: Nullable<string>;
  deployedUrl: Nullable<string>;
  userId: Nullable<string>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project domain model (Aggregate Root)
 * Contains all business logic related to projects
 */
export class Project extends AggregateRoot<ProjectProps> {
  private constructor(props: ProjectProps, id: Identifier) {
    super(props, id);
  }

  static create(data: {
    name: string;
    description?: string;
    userId?: string;
  }): Project {
    const now = new Date();
    
    return new Project(
      {
        name: data.name,
        description: data.description || null,
        status: ProjectStatus.DRAFT,
        previewUrl: null,
        deployedUrl: null,
        userId: data.userId || null,
        createdAt: now,
        updatedAt: now,
      },
      Identifier.create()
    );
  }

  static fromPersistence(data: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    preview_url: string | null;
    deployed_url: string | null;
    user_id: string | null;
    created_at: string | Date;
    updated_at: string | Date;
  }): Project {
    return new Project(
      {
        name: data.name,
        description: data.description,
        status: data.status as ProjectStatus,
        previewUrl: data.preview_url,
        deployedUrl: data.deployed_url,
        userId: data.user_id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      },
      Identifier.fromString(data.id)
    );
  }

  // Getters
  get name(): string {
    return this.props.name;
  }

  get description(): Nullable<string> {
    return this.props.description;
  }

  get status(): ProjectStatus {
    return this.props.status;
  }

  get previewUrl(): Nullable<string> {
    return this.props.previewUrl;
  }

  get deployedUrl(): Nullable<string> {
    return this.props.deployedUrl;
  }

  get userId(): Nullable<string> {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business logic methods
  updatePreviewUrl(url: string): void {
    this.props.previewUrl = url;
    this.props.status = ProjectStatus.PREVIEW;
    this.props.updatedAt = new Date();
  }

  clearPreview(): void {
    this.props.previewUrl = null;
    this.props.status = ProjectStatus.DRAFT;
    this.props.updatedAt = new Date();
  }

  updateDeployedUrl(url: string): void {
    this.props.deployedUrl = url;
    this.props.status = ProjectStatus.DEPLOYED;
    this.props.updatedAt = new Date();
  }

  updateDetails(data: { name?: string; description?: string }): void {
    if (data.name) {
      this.props.name = data.name;
    }
    if (data.description !== undefined) {
      this.props.description = data.description;
    }
    this.props.updatedAt = new Date();
  }

  // Conversion to persistence format
  toPersistence() {
    return {
      id: this.id.toString(),
      name: this.props.name,
      description: this.props.description,
      status: this.props.status,
      preview_url: this.props.previewUrl,
      deployed_url: this.props.deployedUrl,
      user_id: this.props.userId,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString(),
    };
  }

  // Override toJSON to return snake_case for API compatibility
  toJSON() {
    return {
      id: this.id.toString(),
      name: this.props.name,
      description: this.props.description,
      status: this.props.status,
      preview_url: this.props.previewUrl,
      deployed_url: this.props.deployedUrl,
      user_id: this.props.userId,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString(),
    };
  }
}
