import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { ApiError } from '../services/apiClient';
import * as familyApi from '../services/family.service';
import * as treeApi from '../services/tree.service';
import { renderWithProviders, citizen } from '../test/renderWithProviders';

vi.mock('../services/auth.service');
vi.mock('../services/family.service');
vi.mock('../services/tree.service');

beforeEach(() => {
  vi.resetAllMocks();
});

const family = { id: 'family-1', familyId: 'GJ-FAM-8A72K91X' };

const tree = {
  familyId: 'GJ-FAM-8A72K91X',
  familyHeadId: 'member-2',
  status: 'DRAFT',
  generations: 3,
  nodes: [
    {
      id: 'member-1',
      name: 'Vivek Patel',
      gender: 'MALE',
      age: 71,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      isHead: false,
      generation: 0,
    },
    {
      id: 'member-2',
      name: 'Rahul Patel',
      gender: 'MALE',
      age: 41,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      isHead: true,
      generation: 1,
    },
    {
      id: 'member-3',
      name: 'Riya Patel',
      gender: 'FEMALE',
      age: 14,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      isHead: false,
      generation: 2,
    },
  ],
  relationships: [
    {
      id: 'rel-1',
      source: 'member-1',
      target: 'member-2',
      type: 'FATHER',
      verificationStatus: 'VERIFIED',
      isHorizontal: false,
    },
  ],
};

function mockTree(data = tree) {
  familyApi.getMyFamily.mockResolvedValue({ data: { family } });
  treeApi.getFamilyTree.mockResolvedValue({ data });
}

describe('FamilyTreePage', () => {
  it('summarises the tree', async () => {
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    // The page is code-split, so wait for the lazy chunk to mount before
    // asserting on its content.
    await screen.findByTestId('family-tree-canvas', {}, { timeout: 5000 });
    expect(
      screen.getByText(/3 members across 3 generations/i)
    ).toBeInTheDocument();
  });

  it('renders the canvas', async () => {
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(await screen.findByTestId('family-tree-canvas')).toBeInTheDocument();
  });

  it('offers a text equivalent of the tree for screen readers', async () => {
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    // The canvas alone is not accessible, so the same data is listed.
    expect(
      await screen.findByText(/vivek patel, generation 1/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/rahul patel, generation 2, family head/i)
    ).toBeInTheDocument();
  });

  it('explains the line styles', async () => {
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(
      await screen.findByText(/dashed lines are relationships not yet verified/i)
    ).toBeInTheDocument();
  });

  it('filters to verified relationships on request', async () => {
    const user = userEvent.setup();
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    await screen.findByTestId('family-tree-canvas');
    await user.click(screen.getByLabelText(/show verified relationships only/i));

    await waitFor(() => {
      expect(treeApi.getFamilyTree).toHaveBeenLastCalledWith('family-1', {
        verificationStatus: 'VERIFIED',
      });
    });
  });

  it('prompts when no relationships exist yet', async () => {
    mockTree({ ...tree, relationships: [] });
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(
      await screen.findByText(/add relationships between members/i)
    ).toBeInTheDocument();
  });

  it('explains an empty verified-only view differently', async () => {
    const user = userEvent.setup();
    mockTree();
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });
    await screen.findByTestId('family-tree-canvas');

    treeApi.getFamilyTree.mockResolvedValue({
      data: { ...tree, relationships: [] },
    });
    await user.click(screen.getByLabelText(/show verified relationships only/i));

    expect(
      await screen.findByText(/no relationships have been verified yet/i)
    ).toBeInTheDocument();
  });

  it('handles a single-member family', async () => {
    mockTree({
      ...tree,
      generations: 1,
      nodes: [tree.nodes[1]],
      relationships: [],
    });
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(
      await screen.findByText(/1 member across 1 generation/i)
    ).toBeInTheDocument();
  });

  it('prompts registration when there is no family', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family: null } });
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(
      await screen.findByText(/register your family to see your family tree/i)
    ).toBeInTheDocument();
    expect(treeApi.getFamilyTree).not.toHaveBeenCalled();
  });

  it('reports a failure to load', async () => {
    familyApi.getMyFamily.mockResolvedValue({ data: { family } });
    treeApi.getFamilyTree.mockRejectedValue(
      new ApiError('Cannot reach the server. Check your connection.', {
        isNetworkError: true,
      })
    );
    renderWithProviders(<App />, { route: '/family/tree', user: citizen });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot reach the server/i
    );
  });
});
