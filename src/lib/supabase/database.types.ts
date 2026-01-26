export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          canvas_data: any;
          generated_code: string | null;
          framework: string;
          is_public: boolean;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          description?: string | null;
          canvas_data?: any;
          generated_code?: string | null;
          framework?: string;
          is_public?: boolean;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          canvas_data?: any;
          generated_code?: string | null;
          framework?: string;
          is_public?: boolean;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      iterations: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          canvas_data: any;
          generated_code: string;
          prompt_used: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_number?: number;
          canvas_data: any;
          generated_code: string;
          prompt_used?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          version_number?: number;
          canvas_data?: any;
          generated_code?: string;
          prompt_used?: string | null;
          created_at?: string;
        };
      };
      canvas_snapshots: {
        Row: {
          id: string;
          project_id: string;
          snapshot_url: string;
          snapshot_type: "png" | "svg";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          snapshot_url: string;
          snapshot_type?: "png" | "svg";
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          snapshot_url?: string;
          snapshot_type?: "png" | "svg";
          created_at?: string;
        };
      };
    };
  };
}
