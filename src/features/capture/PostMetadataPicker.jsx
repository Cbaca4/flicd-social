import React from "react";
import LocationPicker from "./LocationPicker.jsx";
import TagPeoplePicker from "../social/TagPeoplePicker.jsx";

export default function PostMetadataPicker({ location, onLocationChange, taggedUsers, onTaggedUsersChange, disabled = false }) {
  return (
    <div className="stack">
      <LocationPicker value={location} onChange={onLocationChange} disabled={disabled} />
      <TagPeoplePicker value={taggedUsers} onChange={onTaggedUsersChange} disabled={disabled} />
    </div>
  );
}
