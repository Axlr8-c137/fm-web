import React, { useState } from 'react';
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { Box, Paper, alpha, useTheme } from '@mui/material';

interface DataTableProps<T> {
  rows: T[];
  columns: GridColDef[];
  loading?: boolean;
  onSelectionChange?: (selection: GridRowSelectionModel) => void;
  getRowId?: (row: T) => string | number;
  pageSize?: number;
}

/**
 * A reusable, premium Data Table component built on MUI X-Data-Grid.
 * Features:
 * - Integrated Sorting
 * - Global Search/Filtering
 * - Multi-row selection
 * - Pagination controls
 * - Dense/Standard padding toggle
 * - Export options
 * - Column visibility management
 */
export function DataTable<T extends Record<string, any>>({
  rows,
  columns,
  loading = false,
  onSelectionChange,
  getRowId,
  pageSize = 10,
}: DataTableProps<T>) {
  const theme = useTheme();
  const [paginationModel, setPaginationModel] = useState({
    pageSize,
    page: 0,
  });

  const CustomToolbar = () => {
    return (
      <GridToolbarContainer
        sx={{
          p: 1.5,
          gap: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <GridToolbarColumnsButton />
          <GridToolbarFilterButton />
          <GridToolbarDensitySelector />
          <GridToolbarExport />
        </Box>
        <GridToolbarQuickFilter
          sx={{
            '& .MuiInputBase-root': {
              borderRadius: 2,
              px: 1,
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
              },
              '&.Mui-focused': {
                backgroundColor: alpha(theme.palette.text.primary, 0.05),
                boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
              },
            },
            '& .MuiInput-underline:before, & .MuiInput-underline:after': {
              display: 'none',
            },
          }}
          placeholder="Search..."
        />
      </GridToolbarContainer>
    );
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: 650,
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        '& .MuiDataGrid-root': {
          border: 'none',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            color: theme.palette.text.primary,
            fontWeight: 600,
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.02),
          },
          '& .MuiDataGrid-row.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
            },
          },
        },
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={onSelectionChange}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[5, 10, 25, 50]}
        slots={{
          toolbar: CustomToolbar,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
          },
        }}
        sx={{
          '--DataGrid-containerBackground': theme.palette.background.paper,
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            color: theme.palette.text.primary,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${theme.palette.divider}`,
          },
        }}
      />
    </Paper>
  );
}
