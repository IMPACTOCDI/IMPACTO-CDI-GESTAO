import { Database } from './database.types';

export type Tables = Database['public']['Tables'];
export type Enums = Database['public']['Enums'];

export type Project = Tables['projects']['Row'] & {
  project_members: Tables['project_members']['Row'][];
  tasks: Tables['tasks']['Row'][];
};

export type ProjectMember = Tables['project_members']['Row'] & {
  profile: Tables['profiles']['Row'];
};

export type Task = Tables['tasks']['Row'] & {
  tags: string[];
  comments: Tables['comments']['Row'][];
  project: Project;
  assignedTo: Tables['profiles']['Row'];
};

export type Comment = Tables['comments']['Row'] & {
  user: Tables['profiles']['Row'];
};

export type Profile = Tables['profiles']['Row'];

export type ProjectInsert = Tables['projects']['Insert'];
export type ProjectUpdate = Tables['projects']['Update'];

export type TaskInsert = Tables['tasks']['Insert'];
export type TaskUpdate = Tables['tasks']['Update'];

export type CommentInsert = Tables['comments']['Insert'];
export type CommentUpdate = Tables['comments']['Update'];

export type ProjectMemberInsert = Tables['project_members']['Insert'];
export type ProjectMemberUpdate = Tables['project_members']['Update'];

// Tipos estendidos
export type ExtendedTask = Task & {
  projectName?: string;
  tags?: string[];
  comments?: Comment[];
  assigned_profile?: Profile;
};

export type ExtendedProject = Project & {
  tasks?: ExtendedTask[];
  members?: ProjectMember[];
  creator?: Profile;
};

export type ExtendedComment = Comment & {
  profiles?: Profile;
};

export type ExtendedProjectMember = ProjectMember & {
  profiles?: Profile;
}; 