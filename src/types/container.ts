// src/types/container.ts
export interface Container {
    name: string;
    status: string;
    port?: string;
}

export interface ContainerInfo {
    name: string;
    status: string;
    info: {
        name: string;
        version: string;
        port?: number;
        edition?: string;
        type?: string;
        adminPassword?: string;
        dbFilter?: boolean;
        createdAt: string;
        [key: string]: any;
    };
}

export type ContainerType = 'odoo' | 'postgres';