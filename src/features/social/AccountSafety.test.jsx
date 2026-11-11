/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'me', options);
const { json } = vi.hoisted(() => ({ json: vi.fn() }));
vi.mock("../home/mediaSessionApi.js", () => ({ mediaApi: { json } }));
import AccountSafety from "./AccountSafety.jsx";
beforeEach(() => { vi.clearAllMocks(); json.mockResolvedValue({ blocked_by_me: false, is_self: false }); });
afterEach(cleanup);
it("uses the authenticated safety boundary to block and unblock a stable account", async () => {
 render(<AccountSafety accountId="creator" />);
 const button=await screen.findByRole("button",{name:"Block account"});json.mockResolvedValueOnce({blocked_by_me:true});fireEvent.click(button);
 await screen.findByRole("button",{name:"Unblock account"});expect(json).toHaveBeenLastCalledWith("safety/block",{accountId:"creator",blocked:true},{authScope:expect.objectContaining({user:'me'})});
 json.mockResolvedValueOnce({blocked_by_me:false});fireEvent.click(screen.getByRole("button",{name:"Unblock account"}));await screen.findByRole("button",{name:"Block account"});
});
it("does not display a successful block when the backend rejects it", async () => {
 render(<AccountSafety accountId="creator" />);const button=await screen.findByRole("button",{name:"Block account"});json.mockRejectedValueOnce(new Error("denied"));fireEvent.click(button);
 expect(await screen.findByRole("alert")).toHaveTextContent("denied");expect(screen.getByRole("button",{name:"Block account"})).toBeEnabled();
});
it("does not offer a self-block shortcut", async () => {
 json.mockResolvedValueOnce({is_self:true});render(<AccountSafety accountId="self" />);await waitFor(()=>expect(json).toHaveBeenCalled());expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
