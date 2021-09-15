// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IBookOfLore {
    function addLoreWithScribe(
        address tokenContract,
        uint256 tokenId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) external;

    function addLore(
        address tokenContract,
        uint256 tokenId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) external;
}

contract LoreWriterMock {
    address bookOfLoreAddress;

    constructor(address _bookOfLoreAddress) {
        bookOfLoreAddress = _bookOfLoreAddress;
    }

    function writeLore(
        address tokenContract,
        uint256 tokenId,
        string memory loreMetadataURI
    ) public {
        IBookOfLore(bookOfLoreAddress).addLoreWithScribe(
            tokenContract,
            tokenId,
            0,
            false,
            loreMetadataURI
        );
    }

    function writeLoreInvalid(
        address tokenContract,
        uint256 tokenId,
        string memory loreMetadataURI
    ) public {
        IBookOfLore(bookOfLoreAddress).addLore(
            tokenContract,
            tokenId,
            0,
            false,
            loreMetadataURI
        );
    }
}
